import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TicketQueue from './pages/TicketQueue';
import TicketDetail from './pages/TicketDetail';
import Analytics from './pages/Analytics';
import LiveDemo from './pages/LiveDemo';

function App() {
    return (
        <Router>
            <div className="flex h-screen bg-gray-100">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/tickets" element={<TicketQueue />} />
                        <Route path="/tickets/:id" element={<TicketDetail />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/demo" element={<LiveDemo />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;