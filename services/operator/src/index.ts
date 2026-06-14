import Docker from 'dockerode';
import { config } from './config.js';
import { logger } from './logger.js';
import { Bus } from './bus.js';
import { Collector } from './collector/index.js';
import { Watcher } from './watcher/index.js';
import { Coordinator } from './coordinator/index.js';
import { StateMachine } from './coordinator/stateMachine.js';
import { Analyzer } from './analyzer/index.js';
import { Executor } from './executor/index.js';
import { Lifecycle } from './lifecycle/index.js';
import { createLLMProvider } from './llm/index.js';
import { createVoiceProvider } from './voice/index.js';

const log = logger;
log.info(
  {
    target: config.prodApp.container,
    socket: config.dockerSocket,
    url: config.prodApp.url,
    images: {
      good: config.prodApp.goodImage,
      badDb: config.prodApp.badImageDb,
      badHealth: config.prodApp.badImageHealth,
    },
    network: config.prodApp.network,
    llm: { baseUrl: config.llm.baseUrl, model: config.llm.model, authHeader: config.llm.apiKeyHeader },
    voice: config.voice.provider,
  },
  'operator starting (real-server target; idle until dashboard starts it)',
);

const docker = new Docker({ socketPath: config.dockerSocket });
const bus = new Bus();

const collector = new Collector(docker, bus, config, log);
const watcher = new Watcher(collector, bus, config, log);
const lifecycle = new Lifecycle(docker, collector, watcher, bus, config, log);
const coordinator = new Coordinator(bus, collector, config, log);

const provider = createLLMProvider(config, log);
const analyzer = new Analyzer(provider, config, log);
const executor = new Executor(lifecycle, config, log);
const voice = createVoiceProvider(config, bus, log);

const stateMachine = new StateMachine(
  coordinator.store,
  analyzer,
  executor,
  voice,
  collector,
  bus,
  config,
  log,
);

coordinator.setDecisionHandler((incidentId, optionKey, decision) =>
  stateMachine.onDecision(incidentId, optionKey, decision),
);
coordinator.setResetHandler(() => {
  stateMachine.reset();
  watcher.rearm();
});
coordinator.setLifecycle(lifecycle);

watcher.attach();
stateMachine.attach();
collector.start(); // poll loop runs, but monitoring stays OFF until the target is started
coordinator.start();
