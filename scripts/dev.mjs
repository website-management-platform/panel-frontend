// Geliştirme: müşteri paneli + örnek web sitesi birlikte açılır. Ctrl+C hepsini kapatır.
// API gerçek backend'dir (panel-api deposu, 8782; veritabanı ve demo verisi için platform-api deposu); ayrıca başlatılır.
import { spawn } from "node:child_process";

const children = [];

const start = (args) => {
  const child = spawn("npm", args, { stdio: "inherit", env: process.env });
  children.push(child);
  return child;
};

start(["run", "dev", "-w", "@wmp/customer-admin"]);
// Örnek müşteri web sitesi (delivery API + SDK); panelin parçası değildir.
start(["run", "dev", "-w", "@wmp/site-demo"]);

const stopAll = () => {
  children.forEach((child) => child.kill("SIGINT"));
};

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
