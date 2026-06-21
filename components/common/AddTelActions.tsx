import type { CSSProperties, ReactNode } from "react";
import { buildTelHref, buildWhatsAppHref } from "@/lib/phone-links";

type AddTelActionsProps = {
  phone?: string | null;
  phoneHref?: string | null;
  whatsappHref?: string | null;
  whatsappText?: string;
  defaultCountryCode?: string;
  className?: string;
  phoneLabel?: string;
  whatsappLabel?: string;
  phoneLinkClassName?: string;
  whatsappLinkClassName?: string;
  phoneLinkStyle?: CSSProperties;
  whatsappLinkStyle?: CSSProperties;
  onWhatsAppClick?: () => void;
  phoneIcon?: ReactNode;
  whatsappIcon?: ReactNode;
  showPhone?: boolean;
  showWhatsApp?: boolean;
};

export default function AddTelActions({
  phone,
  phoneHref,
  whatsappHref,
  whatsappText,
  defaultCountryCode,
  className = "add-tel-actions",
  phoneLabel = "Téléphone",
  whatsappLabel = "WhatsApp",
  phoneLinkClassName,
  whatsappLinkClassName,
  phoneLinkStyle,
  whatsappLinkStyle,
  onWhatsAppClick,
  phoneIcon,
  whatsappIcon,
  showPhone = true,
  showWhatsApp = true
}: AddTelActionsProps) {
  const resolvedPhoneHref =
    phoneHref ?? buildTelHref(phone, { defaultCountryCode });

  const resolvedWhatsAppHref =
    whatsappHref ?? buildWhatsAppHref(phone, whatsappText, { defaultCountryCode });

  if (!resolvedPhoneHref && !resolvedWhatsAppHref) return null;

  return (
    <div className={className}>
      {showPhone && resolvedPhoneHref ? (
        <a className={phoneLinkClassName} style={phoneLinkStyle} href={resolvedPhoneHref}>
          {phoneIcon}
          {phoneLabel}
        </a>
      ) : null}

      {showWhatsApp && resolvedWhatsAppHref ? (
        <a
          className={whatsappLinkClassName}
          style={whatsappLinkStyle}
          href={resolvedWhatsAppHref}
          onClick={onWhatsAppClick}
          rel="noreferrer"
          target="_blank"
        >
          {whatsappIcon}
          {whatsappLabel}
        </a>
      ) : null}
    </div>
  );
}
