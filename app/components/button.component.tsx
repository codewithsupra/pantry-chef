import classNames from "classnames";

type buttonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    className?:string;
    name?:string;
    isLoading?:boolean;
}
export  default function Button({children,className,isLoading,disabled,...props}:buttonProps){
    return(
        <button
            {...props}
            disabled={Boolean(disabled || isLoading)}
            aria-busy={isLoading || undefined}
            className={classNames('flex px-3 py-2 rounded-lg justify-center items-center gap-2',
            className
          )}>
              {children}
        </button>
    )
}
export function PrimaryButton({className,isLoading,...otherProps}:buttonProps){
    return <Button isLoading={isLoading} className={classNames('text-white bg-primary hover:bg-primary-light' ,
        {'bg-red-400':isLoading},
        className)} {...otherProps} />

}

export function SaveButton({ className, isLoading, ...otherProps }: buttonProps) {
    return (
        <Button
            isLoading={isLoading}
            className={classNames(
                "border-2 border-green-600 text-green-700 hover:bg-green-50",
                { "opacity-50": isLoading },
                className
            )}
            {...otherProps}
        />
    );
}

export function DeleteButton({ className, isLoading, ...otherProps }: buttonProps) {
    return (
        <Button
            isLoading={isLoading}
            className={classNames(
                "border-2 border-red-400 text-red-500 hover:bg-red-50",
                { "opacity-50": isLoading },
                className
            )}
            {...otherProps}
        />
    );
}
