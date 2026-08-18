"use client";

import type { ReactNode } from "react";
import { Popconfirm as AntPopconfirm } from "antd";

type PopconfirmProps = {
  title: ReactNode;
  description?: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  placement?:
    | "top"
    | "left"
    | "right"
    | "bottom"
    | "topLeft"
    | "topRight"
    | "bottomLeft"
    | "bottomRight"
    | "leftTop"
    | "leftBottom"
    | "rightTop"
    | "rightBottom";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
};

/**
 * Wraps antd's Popconfirm so confirmation popovers get automatic positioning
 * (viewport-aware flipping) and the app theme, with i18n-friendly labels and
 * a danger variant.
 */
export default function Popconfirm({
  title,
  description,
  okText = "OK",
  cancelText = "Cancel",
  danger = false,
  placement = "top",
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  children
}: PopconfirmProps) {
  return (
    <AntPopconfirm
      title={title}
      description={description}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={danger ? { danger: true } : undefined}
      placement={placement}
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {children}
    </AntPopconfirm>
  );
}
