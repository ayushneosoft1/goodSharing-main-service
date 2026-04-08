import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { gateway } from "./gateway.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const server = new ApolloServer({
  gateway,
  csrfPrevention: false,
  plugins: [
    ApolloServerPluginLandingPageLocalDefault({
      embed: true,
    }),
  ],
});

startStandaloneServer(server, {
  listen: { port: 4000, host: "0.0.0.0" },

  // ✅ ADD CORS HERE
  cors: {
    origin: "*", // allow all origins (for development)
    credentials: true,
  },

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
    } catch (err) {
      console.log("Invalid token:", err.message);
      throw new Error("Invalid or expired token");
    }
  },
}).then(() => {
  console.log("Main Service running on http://0.0.0.0:4000/graphql");
});
