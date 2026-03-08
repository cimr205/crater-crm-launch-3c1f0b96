import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10 mx-auto">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">Noget gik galt</h1>
            <p className="text-sm text-muted-foreground">
              Der opstod en uventet fejl. Prøv at genindlæse siden — det løser det i de fleste tilfælde.
            </p>
            {this.state.error?.message && (
              <p className="text-xs font-mono bg-muted rounded-lg px-3 py-2 text-muted-foreground break-all">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Genindlæs siden
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
