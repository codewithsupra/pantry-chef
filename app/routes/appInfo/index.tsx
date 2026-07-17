import { redirect } from "react-router";

export function loader(){
    return redirect('/app/recipes')
    // return new Response(null,{
    //     status:302,
    //     headers:{
    //         Location:"/app/pantry"
    //     }
    // })
}