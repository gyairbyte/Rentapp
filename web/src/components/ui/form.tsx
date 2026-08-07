'use client'

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.name} className="text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={props.name}
        className={`w-full rounded-md border px-3 py-2 text-sm ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
)
Field.displayName = 'Field'

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: { value: string; label: string }[]
  error?: string
  placeholder?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, options, error, placeholder, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.name} className="text-sm font-medium">
        {label}
      </label>
      <select
        ref={ref}
        id={props.name}
        className={`w-full rounded-md border px-3 py-2 text-sm ${className}`}
        {...props}
      >
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
)
SelectField.displayName = 'SelectField'

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.name} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={props.name}
        className={`w-full rounded-md border px-3 py-2 text-sm ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
)
TextareaField.displayName = 'TextareaField'

type CheckboxFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function CheckboxField({ label, ...props }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  )
}
