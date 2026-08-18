import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { TasksProvider } from "./context/TasksContext";
import { Shell } from "./components/Shell";
import { LiveViewerShell } from "./components/LiveViewerShell";
import { parseRoomFromLocation } from "./lib/liveSession";
import "./App.css";

function App() {
  const roomCode = parseRoomFromLocation();
  if (roomCode) return <LiveViewerShell roomCode={roomCode} />;

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
