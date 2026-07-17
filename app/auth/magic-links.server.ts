import Cryptr from "cryptr";
import { errorJSON } from "~/models/utils";
if(!process.env.MAGIC_LINK_KEY!){
    throw new Error('MAgic Link key should be created!!!')
}

const cryptr= new Cryptr(process.env.MAGIC_LINK_KEY!)

type MagicLinkPayload={
    email:string;
    nonce:string;
    createdAt:string;
}
export function generateMagicLink(email:string,nonce:string){
    const payload:MagicLinkPayload={
        email,
        nonce,
        createdAt:new Date().toISOString()
    }
    const encryptedPayload=cryptr.encrypt(JSON.stringify(payload));
    
    const url=new URL(process.env.ORIGIN!)
    url.pathname="/validate-magic-link";
    url.searchParams.set("magic",encryptedPayload);
    return url.toString();
}



function isMagicLinkPayload(value:any):value is MagicLinkPayload{
    return (
        typeof value==='object' && typeof value.email==='string' && typeof value.nonce==='string' && typeof value.createdAt==='string' 
    )
}


export function getMagicLinkPayload(request: Request) {
    const url = new URL(request.url);
    const magic = url.searchParams.get("magic");
    if (!magic) {
        throw errorJSON("Missing magic link", 400);
    }
   const payload= JSON.parse(cryptr.decrypt(magic));
   if(!isMagicLinkPayload(payload)){
    throw errorJSON('invalid payload', 400);
   }
   return payload;
}
