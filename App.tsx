import { useEffect } from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { initializeDatabase } from "./src/services/sqlite";

export default function App() {
  useEffect(() => {
    async function initDB() {
      try {
        await initializeDatabase();
      } catch (error) {
        console.error("Erro ao inicializar o banco de dados:", error);
      }
    }
    initDB();
  }, []);

  return <AppNavigator />;
}