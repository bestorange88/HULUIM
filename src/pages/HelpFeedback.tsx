import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send, HelpCircle, MessageCircle, Phone, Mail, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

export default function HelpFeedback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("suggestion");
  const [contactInfo, setContactInfo] = useState("");
  const [loading, setLoading] = useState(false);
    const [showContactUs, setShowContactUs] = useState(false);
    const { t } = useTranslation();

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast({
        title: t("helpFeedback.enterFeedback"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: t("common.error"),
          description: t("common.pleaseLogin"),
          variant: "destructive",
        });
        return;
      }
      
      // Save feedback to database
      const { error } = await supabase
        .from("user_feedbacks")
        .insert({
          user_id: user.id,
          type: feedbackType,
          content: feedback.trim(),
          contact_info: contactInfo.trim() || null,
        });

      if (error) throw error;
      
      toast({
        title: t("helpFeedback.submitSuccess"),
        description: t("helpFeedback.submitSuccessDesc"),
      });
      setFeedback("");
      setContactInfo("");
      setFeedbackType("suggestion");
    } catch (error) {
      console.error("Feedback submit error:", error);
      toast({
        title: t("common.error"),
        description: t("helpFeedback.submitFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const faqs = [
    {
      question: t("helpFeedback.faq1Q"),
      answer: t("helpFeedback.faq1A"),
    },
    {
      question: t("helpFeedback.faq2Q"),
      answer: t("helpFeedback.faq2A"),
    },
    {
      question: t("helpFeedback.faq3Q"),
      answer: t("helpFeedback.faq3A"),
    },
    {
      question: t("helpFeedback.faq4Q"),
      answer: t("helpFeedback.faq4A"),
    },
    {
      question: t("helpFeedback.faq5Q"),
      answer: t("helpFeedback.faq5A"),
    },
    {
      question: t("helpFeedback.faq6Q"),
      answer: t("helpFeedback.faq6A"),
    },
    {
      question: t("helpFeedback.faq7Q"),
      answer: t("helpFeedback.faq7A"),
    },
  ];

  const feedbackTypes = [
    { value: "suggestion", label: t("helpFeedback.typeSuggestion") },
    { value: "bug", label: t("helpFeedback.typeBug") },
    { value: "complaint", label: t("helpFeedback.typeComplaint") },
    { value: "other", label: t("helpFeedback.typeOther") },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3 shadow-card">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{t("helpFeedback.title")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Contact Info - Hidden by default per user request */}
        {showContactUs && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {t("helpFeedback.contactUs")}
            </h2>
            <div className="rounded-lg bg-card border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{t("helpFeedback.phone")}</p>
                  <p className="text-sm text-muted-foreground">4001013230</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{t("helpFeedback.email")}</p>
                  <p className="text-sm text-muted-foreground">ypkfjt001@gmail.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{t("helpFeedback.onlineSupport")}</p>
                  <p className="text-sm text-muted-foreground">{t("helpFeedback.onlineSupportDesc")}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t("helpFeedback.faq")}
          </h2>
          <div className="rounded-lg bg-card border border-border overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="px-4 hover:no-underline text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* Feedback Form */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Send className="h-4 w-4" />
            {t("helpFeedback.feedback")}
          </h2>
          <div className="rounded-lg bg-card border border-border p-4 space-y-4">
            <div className="space-y-2">
              <Label>{t("helpFeedback.feedbackType")}</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feedbackTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">{t("helpFeedback.feedbackContent")}</Label>
              <Textarea
                id="feedback"
                placeholder={t("helpFeedback.feedbackPlaceholder")}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {feedback.length} / 500
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">{t("helpFeedback.contactOptional")}</Label>
              <Input
                id="contact"
                placeholder={t("helpFeedback.contactPlaceholder")}
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !feedback.trim()}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {loading ? (
                <>
                  <Send className="mr-2 h-4 w-4 animate-pulse" />
                  {t("helpFeedback.submitting")}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("helpFeedback.submit")}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Links */}
        <div className="space-y-2">
          <div className="rounded-lg bg-card border border-border divide-y divide-border">
            <button
              onClick={() => navigate("/privacy-policy")}
              className="w-full p-4 flex items-center justify-between hover:bg-accent/10 transition-colors"
            >
              <span>{t("profile.privacyPolicy")}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/terms-of-service")}
              className="w-full p-4 flex items-center justify-between hover:bg-accent/10 transition-colors"
            >
              <span>{t("profile.termsOfService")}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/about-us")}
              className="w-full p-4 flex items-center justify-between hover:bg-accent/10 transition-colors"
            >
              <span>{t("profile.aboutUs")}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
