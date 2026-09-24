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

  buildService({ name, url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        console.log("SUBGRAPH:", name);
        console.log("OPERATION:", request.operationName);
        console.log("HAS USER:", Boolean(context.user));

        if (context.user) {
          const xUser = JSON.stringify(context.user);

          request.http.headers.set("x-user", xUser);

          console.log(
            "X-USER HEADER SET:",
            Boolean(request.http.headers.get("x-user")),
          );
        }
      },
    });
  },
});
