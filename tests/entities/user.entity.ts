import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Simple } from "./simple.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  simpleId!: number;

  @ManyToOne(() => Simple, (simple) => simple.users)
  @JoinColumn({ name: "simpleId" })
  simple!: Simple;

  @Column({ default: null, onUpdate: "CURRENT_TIMESTAMP" })
  updateDate!: Date;

  @Column({ default: () => "CURRENT_TIMESTAMP" })
  creationDate!: Date;
}
