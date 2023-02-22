import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

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
}
