import { Await, Link, Outlet, useLoaderData, useLocation, useRouteError } from "react-router";
import React from 'react';
import type { Route } from "./+types/settings";
export async function loader(){
    const slowMessage= new Promise<string>((resolve,reject)=>setTimeout(()=>resolve('message is slow'),700))
    return {
        message:'helooooo',
        slowMessage,
        date:new Date(Date.parse("2025-01-01"))
    }
}

export default function Settings() {  
    const location=useLocation();
    const data=useLoaderData<typeof loader>();
    const{slowMessage,message,date}=data;
    return (
        <div className="flex flex-col items-center justify-center h-screen border-2 border-gray-300  rounded-lg p-8">
            <h1 className="text-4xl font-bold mb-4">Settings Page</h1>
            <p className="text-lg text-gray-600">{message}</p>
            <p>Date:{date.toLocaleString()}</p>
            <React.Suspense fallback={<div>Loading....</div>} key={location.pathname}>
            <Await resolve={slowMessage} errorElement={<div>Could not load</div>}>
                {(value)=><p>{value}</p>}

            </Await>
            </React.Suspense>
            
            <nav>
                <ul className="flex gap-4">
                    <li>
                        <Link to="app">go to App</Link>
                    </li>
                    <li>
                        <Link to="profile">go to Profile</Link>
                    </li>
                </ul>
            </nav>
            <Outlet />
        </div>
    );
}

export function ErrorBoundary({error}:Route.ErrorBoundaryProps){
    // const error=useRouteError()
    if(error instanceof Error){
        return(
        <div className="bg-red-300 border-2 border-red-600 roundd-md p-4">
        <h1>Something went wrong! Keep trying</h1>
        <p>{error.message}</p>

    </div>
        )}
    return(
        <div>
            <span className="text-2xl">Unexpected Error</span>

        </div>
    )

        

    }
    

