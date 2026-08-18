import { SettingsProvider } from "./context/SettingsContext";
import { TasksProvider } from "./context/TasksContext";
import { Shell } from "./components/Shell";
import "./App.css";

function App() {
  return (
    <SettingsProvider>
      <TasksProvider>
        <Shell />
      </TasksProvider>
    </SettingsProvider>
  );
}

export default App;
