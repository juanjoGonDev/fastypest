import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { type Simple } from "./simple.entity";

@Entity()
export class Basic {
  @PrimaryColumn()
  name!: string;

  @Column()
  simpleId!: number;

  @ManyToOne("Simple", (simple: Simple) => simple.basics)
  @JoinColumn({ name: "simpleId" })
  simple!: Simple;

  @Column({ default: null, onUpdate: "CURRENT_TIMESTAMP" })
  updateDate!: Date;

  @Column({ default: () => "CURRENT_TIMESTAMP" })
  creationDate!: Date;
}
