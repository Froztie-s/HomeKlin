"use client";

import { useState } from "react";

type AreaSelectProps = {
  id: string;
  name: string;
  /** The area the page shows; a new value from the server (another address) replaces the choice. */
  value: string;
  options: readonly { value: string; label: string }[];
  className: string;
};

// The native area <select>, kept in step with the page: when the address changes (a link to another
// area, the back button), the server sends a new value and the select follows it, without remounting,
// so keyboard focus stays where it was. Choosing an area only updates the select; the form around it
// decides what happens next (src/components/customer/catalog-form.tsx on /services, a plain GET form
// on /home). Source: https://react.dev/reference/react/useState#storing-information-from-previous-renders
export function AreaSelect({ id, name, value, options, className }: AreaSelectProps) {
  const [selected, setSelected] = useState(value);
  const [fromServer, setFromServer] = useState(value);
  if (value !== fromServer) {
    setFromServer(value);
    setSelected(value);
  }
  return (
    <select
      id={id}
      name={name}
      value={selected}
      onChange={(event) => setSelected(event.target.value)}
      className={className}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
