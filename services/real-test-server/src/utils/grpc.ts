import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import config from "../config";

const PROTO_PATH = path.join(__dirname, "../../src/proto/notification.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition) as any;

// Create the client instance
const client = new notificationProto.notification.NotificationService(
  config.NOTIFICATION_GRPC_URL || "localhost:50051",
  grpc.credentials.createInsecure()
);

export const sendNotificationEmail = (
  userId: string,
  email: string,
  templateType: string,
  data: object
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const payload = {
      userId,
      email,
      templateType,
      dataJson: JSON.stringify(data), // gRPC handles strings better than generic objects
    };

    client.SendEmail(payload, (error: any, response: any) => {
      if (error) {
        console.error("gRPC Error:", error);
        return reject(error);
      }
      resolve(response);
    });
  });
};
