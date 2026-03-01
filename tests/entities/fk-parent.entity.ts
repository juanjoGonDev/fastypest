import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { type FkChild } from "./fk-child.entity";

@Entity("fk_parent")
export class FkParent {
  @PrimaryColumn({ name: "id_a", type: "int" })
  idA!: number;

  @PrimaryColumn({ name: "id_b", type: "int" })
  idB!: number;

  @Column({ name: "value_name" })
  valueName!: string;

  @OneToMany("FkChild", (fkChild: FkChild) => fkChild.parent)
  children!: FkChild[];
}
