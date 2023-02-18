import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "simple" })
export class Simple {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ default: null })
  updateDate!: Date;

  @Column({ default: () => "CURRENT_TIMESTAMP" })
  creationDate!: Date;
}
