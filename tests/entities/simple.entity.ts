import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

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

  @OneToMany(() => User, (user) => user.simpleId)
  users!: User[];
}
