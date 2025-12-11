import React from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../components/ui/form";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { toast } from "sonner";
import { api } from "../../../shared/api";
import { Loader2, Plus } from "lucide-react";

export function AddPhaseDialog({ projectId, onPhaseAdded }) {
  const [open, setOpen] = React.useState(false);
  const form = useForm({
    defaultValues: {
      name: "",
      status: "pending",
      start_date: "",
      end_date: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      const res = await api.addProjectPhase(projectId, data);
      toast.success("Faza uspješno dodana");
      setOpen(false);
      form.reset();
      if (onPhaseAdded) onPhaseAdded(res.data);
    } catch (error) {
      console.error("Error adding phase:", error);
      toast.error("Greška prilikom dodavanja faze");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Dodaj Fazu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Faza Projekta</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Naziv je obavezan" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naziv Faze</FormLabel>
                  <FormControl>
                    <Input placeholder="npr. Građevinski radovi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                rules={{ required: "Datum početka je obavezan" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Početak</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                rules={{ required: "Datum završetka je obavezan" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Završetak</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Odaberi status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Na čekanju</SelectItem>
                      <SelectItem value="in_progress">U tijeku</SelectItem>
                      <SelectItem value="completed">Završeno</SelectItem>
                      <SelectItem value="delayed">Kasni</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
            >
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Spremi Fazu
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
