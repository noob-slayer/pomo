import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { TasksProvider } from "./context/TasksContext";
import { Shell } from "./components/Shell";
import { PublicProfilePage } from "./components/PublicProfilePage";
import { parsePublicProfileSlugFromLocation } from "./lib/publicProfile";
import "./App.css";

function App() {
  // a public profile link (?u=<slug>) bypasses the entire authenticated app -- no need for
  // auth/settings/tasks context at all for a read-only page anyone can open with no account
  const publicSlug = parsePublicProfileSlugFromLocation();
  if (publicSlug) return <PublicProfilePage slug={publicSlug} />;

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
