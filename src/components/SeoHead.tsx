import { useEffect } from "react";

type Props = {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: string;
};

const siteOrigin = typeof window !== "undefined" ? window.location.origin : "https://www.growwtrader.in";

export function SeoHead({ title, description, canonicalPath, ogType = "website" }: Props) {
  useEffect(() => {
    document.title = title;
    const setMeta = (name: string, attr: "name" | "property", content: string) => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", "name", description);
    setMeta("og:title", "property", title);
    setMeta("og:description", "property", description);
    setMeta("og:type", "property", ogType);
    const url = `${siteOrigin}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;
    setMeta("og:url", "property", url);

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;
  }, [title, description, canonicalPath, ogType]);

  return null;
}
