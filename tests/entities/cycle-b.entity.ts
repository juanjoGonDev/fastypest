import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from "typeorm";
import { type CycleA } from "./cycle-a.entity";

@Entity("cycle_b")
export class CycleB {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({ name: "a_id", type: "int", nullable: true })
  aId!: number | null;

  @Column({ name: "value_name" })
  valueName!: string;

  @ManyToOne("CycleA", (cycleA: CycleA) => cycleA.edgeCycleBs, {
    nullable: true,
  })
  @JoinColumn({ name: "a_id", referencedColumnName: "id" })
  edgeCycleA!: CycleA | null;

  @OneToMany("CycleA", (cycleA: CycleA) => cycleA.edgeCycleB)
  edgeCycleAs!: CycleA[];
}
