import type { JwtPayload } from "jsonwebtoken";

export interface UserJwtPaylod extends JwtPayload {
  _id: string;
}
