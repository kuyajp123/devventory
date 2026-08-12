import { buttonVariants, Card } from '@heroui/react';
import { Link } from 'react-router';
import appIcon from '@/assets/devventory-app-icon.png';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center">
      <Card>
        <Card.Content className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <img src={appIcon} alt="Devventory" className="h-8 w-8 rounded" />
            <span className="font-mono text-sm font-bold">Devventory</span>
          </div>
          <p className="text-sm font-medium text-muted">404</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-muted">
            The requested Devventory screen does not exist.
          </p>
          <Link className={buttonVariants({ variant: 'primary' })} to="/">
            Return home
          </Link>
        </Card.Content>
      </Card>
    </section>
  );
}
