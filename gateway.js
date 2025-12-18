import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";

export const gateway = new ApolloGateway({
  serviceList: [
    { name: "users", url: "http://localhost:4001" },
    { name: "posts", url: "http://localhost:4002" },
  ],

  buildService({ url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        if (context.user) {
          request.http.headers.set("x-user", JSON.stringify(context.user));
        }
      },
    });
  },
});
