import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { gateway } from "./gateway.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const server = new ApolloServer({
  gateway,
});

startStandaloneServer(server, {
  listen: { port: 4000, host: "0.0.0.0" },
  path: "/graphql",
  context: async ({ req }) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return { user: null };
    }

    try {
      const token = authHeader.replace("Bearer ", "");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      return {
        user: decoded,
        headers: {
          ...req.headers,
          "x-user": JSON.stringify(decoded),
        },
      };
    } catch {
      return { user: null };
    }
  },
}).then(() => {
  console.log("Main-service running on 0.0.0.0:4000/graphql");
});
