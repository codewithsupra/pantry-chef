import classNames from "classnames";
import type { InputHTMLAttributes } from "react";

interface PrimaryInputProps extends InputHTMLAttributes<HTMLInputElement> {}
export function PrimaryInput({ className, ...otherProps }: PrimaryInputProps) {
    return (
        <input
            {...otherProps}
            className={classNames(
                'w-full outline-none border-2 border-stone-200 bg-stone-50',
                'focus:border-primary rounded-md p-2 transition-colors text-stone-700 placeholder:text-stone-400',
                className
            )}
        />
    );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    label?: string;
    variant?: "normal" | "ghost";
}
export function Input({ error, label, className, id, variant = "normal", ...otherProps }: InputProps) {
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label htmlFor={id} className="text-sm font-medium text-stone-700">
                    {label}
                </label>
            )}
            <input
                id={id}
                {...otherProps}
                className={classNames(
                    'w-full outline-none transition-colors text-stone-700 placeholder:text-stone-400',
                    variant === "ghost"
                        ? classNames('bg-transparent border-b-2 p-1', error ? 'border-b-red-400 focus:border-b-red-400' : 'border-transparent hover:border-b-stone-300 focus:border-b-primary')
                        : classNames(
                            'border-2 bg-stone-50 rounded-md p-2',
                            error ? 'border-red-400 focus:border-red-400' : 'border-stone-200 focus:border-primary'
                        ),
                    className
                )}
            />
        </div>
    );
}
