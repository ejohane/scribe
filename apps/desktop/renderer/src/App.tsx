import { useEffect, useState } from 'react';
import './App.css';

interface PingResult {
  message: string;
  timestamp: number;
  error?: string;
}

function App() {
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [ipcAvailable, setIpcAvailable] = useState(false);

  useEffect(() => {
    // Check if IPC is available
    if (window.scribe) {
      setIpcAvailable(true);
    }
  }, []);

  const handlePing = async () => {
    try {
      const result = await window.scribe.ping();
      setPingResult(result);
    } catch (error) {
      setPingResult({
        message: 'error',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Scribe</h1>
        <p>Local-first knowledge management system</p>
      </header>
      <main className="app-main">
        <div className="content">
          <p>Ready to start writing...</p>

          <div className="ipc-test">
            <h2>IPC Test</h2>
            <p>IPC Bridge: {ipcAvailable ? '✅ Available' : '❌ Not Available'}</p>

            {ipcAvailable && (
              <>
                <button onClick={handlePing}>Test Ping</button>
                {pingResult && (
                  <div className="ping-result">
                    <p>
                      <strong>Response:</strong> {pingResult.message}
                    </p>
                    <p>
                      <strong>Timestamp:</strong> {new Date(pingResult.timestamp).toISOString()}
                    </p>
                    {pingResult.error && (
                      <p className="error">
                        <strong>Error:</strong> {pingResult.error}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
