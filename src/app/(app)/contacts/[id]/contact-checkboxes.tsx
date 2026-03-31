"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Award, GraduationCap } from "lucide-react";

interface ContactCheckboxesProps {
  contactId: string;
  isAthenaMentor: boolean;
  isAthenaStudent: boolean;
}

export function ContactCheckboxes({ contactId, isAthenaMentor, isAthenaStudent }: ContactCheckboxesProps) {
  const router = useRouter();
  const [mentor, setMentor] = useState(isAthenaMentor);
  const [student, setStudent] = useState(isAthenaStudent);

  async function update(field: string, value: boolean) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      // Revert on failure
      if (field === "isAthenaMentor") setMentor(!value);
      if (field === "isAthenaStudent") setStudent(!value);
      toast.error("Failed to update");
    }
  }

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
          <Award className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="detail-mentor"
            checked={mentor}
            onCheckedChange={(checked) => {
              const val = checked === true;
              setMentor(val);
              update("isAthenaMentor", val);
            }}
          />
          <Label htmlFor="detail-mentor" className="text-sm font-medium cursor-pointer">
            Athena Mentor
          </Label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-blue-500/15 flex items-center justify-center">
          <GraduationCap className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="detail-student"
            checked={student}
            onCheckedChange={(checked) => {
              const val = checked === true;
              setStudent(val);
              update("isAthenaStudent", val);
            }}
          />
          <Label htmlFor="detail-student" className="text-sm font-medium cursor-pointer">
            Athena Student
          </Label>
        </div>
      </div>
    </div>
  );
}
