'use client';

import { useEffect, useRef } from 'react';

export function AutoResizeTextarea({
  value,
  onChange,
  className,
  style,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ajustarAltura = () => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    ajustarAltura();
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={(event) => {
        ajustarAltura();
        onChange?.(event);
      }}
      rows={1}
      style={{ ...style, overflow: 'hidden' }}
      className={className}
    />
  );
}
