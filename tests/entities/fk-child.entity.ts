import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { type FkParent } from "./fk-parent.entity";

@Entity("fk_child")
export class FkChild {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({ name: "parent_id_a", type: "int" })
  parentIdA!: number;

  @Column({ name: "parent_id_b", type: "int" })
  parentIdB!: number;

  @Column({ name: "value_name" })
  valueName!: string;

  @ManyToOne("FkParent", (fkParent: FkParent) => fkParent.children)
  @JoinColumn([
    { name: "parent_id_a", referencedColumnName: "idA" },
    { name: "parent_id_b", referencedColumnName: "idB" },
  ])
  parent!: FkParent;
}
