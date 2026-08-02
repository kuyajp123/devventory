import { buttonVariants, Card } from '@heroui/react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center">
      <Card>
        <Card.Content className="space-y-4">
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
