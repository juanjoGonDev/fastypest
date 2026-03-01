import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from "typeorm";
import { type CycleB } from "./cycle-b.entity";

@Entity("cycle_a")
export class CycleA {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({ name: "b_id", type: "int", nullable: true })
  bId!: number | null;

  @Column({ name: "value_name" })
  valueName!: string;

  @ManyToOne("CycleB", (cycleB: CycleB) => cycleB.edgeCycleA, {
    nullable: true,
  })
  @JoinColumn({ name: "b_id", referencedColumnName: "id" })
  edgeCycleB!: CycleB | null;

  @OneToMany("CycleB", (cycleB: CycleB) => cycleB.edgeCycleA)
  edgeCycleBs!: CycleB[];
}
