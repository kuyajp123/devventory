import { Button } from '@heroui/react';
import { useState } from 'react';
import { appHealthGateway } from '../features/app-health/services/app-health.gateway';

export default function App() {
  const [message, setMessage] = useState('Not checked');

  async function handleHealthCheck() {
    try {
      const result = await appHealthGateway.check();
      setMessage(result);
    } catch {
      setMessage('Unable to communicate with the Rust backend');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold">Devventory</h1>

        <p>{message}</p>

        <Button onPress={handleHealthCheck}>Test Rust connection</Button>
      </div>
    </main>
  );
}
