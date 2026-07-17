import { Prisma } from "@prisma/client";

export async function handleDeleteErrors<T>(deleteFn:()=>T):Promise<T|null>{
    try{
            const deleted= await deleteFn();
            return deleted;
        }
        catch(error){
            if(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                return null; // shelf not found, treat as already deleted
            }
            throw error;
        }

}

export function errorJSON(message:string,status:number){
    return new Response(message,{status})
}