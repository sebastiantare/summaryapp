import { createConnection } from "mysql";

const db = createConnection({
  host: "summaryapp-instance.c5sgkwqcaw8u.sa-east-1.rds.amazonaws.com",
  port: "3306",
  user: "admin",
  password: "",
  database: "newsarticles_db",
});

db.connect((err) => {
  if (err) {
    console.log(err.message);
    return;
  }

  console.log("Database connected.");
})
