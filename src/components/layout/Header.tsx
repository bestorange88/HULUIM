import { Button } from "@/components/ui/button";
import { ExternalLink, LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface HeaderProps {
  title: string;
  linkUrl?: string;
  linkLabel?: string;
  linkIcon?: LucideIcon;
  onLinkClick?: () => void;
  rightContent?: ReactNode;
  showLanguageSwitcher?: boolean;
}

export default function Header({ 
  title, 
  linkUrl, 
  linkLabel = "跳转", 
  linkIcon: LinkIcon,
  onLinkClick,
  rightContent,
  showLanguageSwitcher = false
}: HeaderProps) {
  const navigate = useNavigate();

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick();
    } else if (linkUrl) {
      if (linkUrl.startsWith("http")) {
        window.open(linkUrl, "_blank");
      } else {
        navigate(linkUrl);
      }
    }
  };

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-20 shadow-card backdrop-blur-sm bg-card/95">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      
      <div className="flex items-center gap-2">
        {showLanguageSwitcher && <LanguageSwitcher />}
        
        {rightContent || (linkUrl || onLinkClick) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLinkClick}
            className="gap-2"
          >
            {linkLabel && <span className="text-sm">{linkLabel}</span>}
            {LinkIcon ? <LinkIcon className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </header>
  );
}
