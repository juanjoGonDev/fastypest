import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { type Basic } from "./basic.entity";
import { type User } from "./user.entity";

@Entity()
export class Simple {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ default: null, onUpdate: "CURRENT_TIMESTAMP" })
  updateDate!: Date;

  @Column({ default: () => "CURRENT_TIMESTAMP" })
  creationDate!: Date;

  @OneToMany("User", (user: User) => user.simpleId)
  users!: User[];

  @OneToMany("Basic", (basic: Basic) => basic.simpleId)
  basics!: Basic[];
}
