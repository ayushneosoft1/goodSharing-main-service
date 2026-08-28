import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import dotenv from "dotenv";
dotenv.config();

export const gateway = new ApolloGateway({
  serviceList: [
    { name: "users", url: process.env.USER_SERVICE_URL },
    { name: "posts", url: process.env.POSTS_SERVICE_URL },
    {
      name: "notifications",
      url: process.env.NOTIFICATION_SERVICE_URL,
    },
  ],

  buildService({ url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        console.log("Gateway forwarding user:", context.user);

        if (context.user) {
          request.http.headers.set("x-user", JSON.stringify(context.user));
        }
      },
    });
  },
});
