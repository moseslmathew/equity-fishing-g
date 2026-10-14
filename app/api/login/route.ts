import {authEnv,createSession,equalSecret,sameOrigin,sessionCookie,sessionDuration} from "../../../lib/access";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:"Sign-in must come from this website."},{status:403});
  const config=authEnv();
  if(!config.LOGIN_PASSWORD||!config.SESSION_SECRET||!config.BUCKET)return Response.json({error:"Sign-in is temporarily unavailable."},{status:503});
  try{
    const raw=await request.text();
    if(raw.length>1000)return Response.json({error:"Invalid password."},{status:400});
    const {password}=JSON.parse(raw);
    if(typeof password!=="string"||password.length>200)return Response.json({error:"Invalid password."},{status:400});
    const ip=request.headers.get("cf-connecting-ip")||"shared";
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(config.SESSION_SECRET+ip));
    const id=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const key="access/attempts/"+id,now=Date.now();
    const previous=await config.BUCKET.get(key);
    const attempts=previous?await previous.json<{count:number;until:number}>():{count:0,until:0};
    const matches = await equalSecret(password, config.LOGIN_PASSWORD);
    if (!matches) {
      if (attempts.until > now && attempts.count >= 10) return Response.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429, headers: { "Retry-After": "300", "Cache-Control": "no-store" } });
      await config.BUCKET.put(key, JSON.stringify({ count: attempts.until > now ? attempts.count + 1 : 1, until: attempts.until > now ? attempts.until : now + 300000 }));
      return Response.json({ error: "Incorrect password. Please try again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    await config.BUCKET.delete(key);
    const cookie=await createSession();
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":sessionCookie+"="+cookie+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+sessionDuration}});
  }catch{return Response.json({error:"Sign-in is temporarily unavailable. Please try again."},{status:503});}
}
