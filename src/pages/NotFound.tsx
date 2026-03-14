import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center bg-background text-foreground">
      <h1 className="text-4xl font-display font-bold">404</h1>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground"
      >
        Back to home
      </Link>
    </div>
  );
};

export default NotFound;
