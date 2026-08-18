import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { TasksProvider } from "./context/TasksContext";
import { Shell } from "./components/Shell";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <TasksProvider>
          <Shell />
        </TasksProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
