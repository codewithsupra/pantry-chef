import { data, type LoaderFunction ,useLoaderData} from "react-router";


export const loader:LoaderFunction=()=>{
    return data({message:"Hello from the Profile loader!"})
}
export default function Profile() {
    const{message}=useLoaderData();
    return (
        <div >
            <h1 >Profile Page</h1>
            <p className="text-lg text-gray-600">Welcome to the Profile page!</p>
            <p>{message}</p>
        </div>
    );
}
