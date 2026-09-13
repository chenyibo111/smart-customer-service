import { AdminPage } from '../pages/AdminPage.js';
import { AgentPage } from '../pages/AgentPage.js';
import { ChatPage } from '../pages/ChatPage.js';

export function AppRouter() {
  if (window.location.pathname.startsWith('/agent')) return <AgentPage />;
  if (window.location.pathname.startsWith('/admin')) return <AdminPage />;
  return <ChatPage />;
}
