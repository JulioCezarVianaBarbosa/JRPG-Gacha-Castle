import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const saves = pgTable("saves", {
  slot: integer("slot").primaryKey().default(1),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const highscores = pgTable("highscores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  score: integer("score").notNull(),
  day: integer("day").notNull().default(1),
  stage: integer("stage").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});
