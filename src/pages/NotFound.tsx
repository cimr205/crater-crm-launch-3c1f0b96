import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { createTranslator, isLocale } from "@/lib/i18n";

const NotFound = () => {
  const location = useLocation();
  const parts = location.pathname.split("/");
  const locale = isLocale(parts[1]) ? parts[1] : "en";
  const t = createTranslator(locale);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t("notFound.title")}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("notFound.subtitle")}</p>
        <a href={`/${locale}`} className="text-primary underline hover:text-primary/90">
          {t("notFound.back")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
